package com.example.sns.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.sns.entity.Comment;
import com.example.sns.entity.Post;
import com.example.sns.entity.User;
import com.example.sns.repository.CommentRepository;
import com.example.sns.repository.PostRepository;
import com.example.sns.support.TestUsers;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 "님의 콘텐츠" 화면의 날짜.
 *
 * 이 화면은 정지 근거를 확인하는 곳이라 상대 시간이 아니라 정확한 시각을 서버에서 찍는다.
 * LocalDateTime을 그대로 내보내면 2026-11-18T15:26:52.123처럼 T와 초 이하 자리가 붙어 나온다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminUserContentViewTest {

    // 초와 그 아래 자리까지 있는 시각이어야 그대로 찍혔을 때 드러난다
    private static final LocalDateTime WRITTEN = LocalDateTime.of(2026, 11, 18, 15, 26, 52, 123_000_000);
    private static final LocalDateTime EDITED = LocalDateTime.of(2026, 11, 19, 9, 5, 7);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TestUsers testUsers;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Test
    @DisplayName("작성일과 수정일은 ISO 형식(T, 초 이하 자리) 없이 분까지만 찍힌다")
    void 날짜는_분까지만() throws Exception {
        User admin = testUsers.create("admin1", User.Role.ADMIN);
        User target = testUsers.create("target1");

        Post written = savePost(target, null);
        savePost(target, EDITED);
        saveComment(target, written);

        String html = mockMvc.perform(get("/admin/users/{id}/content", target.getId())
                        .cookie(testUsers.cookie(admin)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(html)
                .doesNotContainPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}")
                .doesNotContain("15:26:52")
                .doesNotContain("09:05:07")
                // 지운 것만 보면 날짜를 아예 안 찍어도 통과하므로, 찍힌 값까지 본다
                .contains("2026/11/18 15:26")
                .contains("2026/11/19 09:05");
    }

    private Post savePost(User author, LocalDateTime updatedAt) {
        Post post = new Post();
        post.setContent("게시글");
        post.setAuthor(author);
        post.setCreatedAt(WRITTEN);
        post.setUpdatedAt(updatedAt);
        return postRepository.save(post);
    }

    private void saveComment(User author, Post post) {
        Comment comment = new Comment();
        comment.setPost(post);
        comment.setAuthor(author);
        comment.setContent("댓글");
        comment.setCreatedAt(WRITTEN);
        commentRepository.save(comment);
    }
}
